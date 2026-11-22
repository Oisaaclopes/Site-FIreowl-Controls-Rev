-- 0123_time_punches_journey_reason
-- Motivo informado pelo funcionário ao ABRIR UMA NOVA JORNADA no mesmo dia em
-- que já existe jornada (2º turno, chamado de emergência etc.). O app só grava
-- essa Entrada depois de uma pergunta explícita + motivo — antes, uma tela
-- desatualizada/toque repetido abria jornadas sem o funcionário querer (caso
-- 13/11). Só o texto; a batida continua sendo a evidência original.
--
-- Aditiva, idempotente. Nula para todas as batidas comuns. 0119/0120 reservadas.

alter table public.time_punches
  add column if not exists journey_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_punches_journey_reason_len'
  ) then
    alter table public.time_punches
      add constraint time_punches_journey_reason_len
      check (journey_reason is null or (type = 'ENTRADA' and char_length(btrim(journey_reason)) between 3 and 500));
  end if;
end $$;
