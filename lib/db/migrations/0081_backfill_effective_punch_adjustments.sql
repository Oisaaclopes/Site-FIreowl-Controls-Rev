-- Corrige o ajuste histórico do Rhuan (ENTRADA 01/09/2026) sem tocar na
-- evidência original em time_punches, e vincula ajustes aprovados órfãos à
-- batida original quando a correspondência é inequívoca.
--
-- Regras:
--   * time_punches.punched_at NUNCA é alterado (evidência auditável).
--   * O único requested_time histórico autorizado aqui é o do Rhuan: 08:01.
--   * Nenhum outro requested_time NULL é preenchido automaticamente.
--   * Idempotente: reexecutar não gera efeito; só aborta em ambiguidade real.

-- =========================================================================
-- A) CASO RHUAN — correção autorizada e específica
-- =========================================================================
do $$
declare
  v_adj_count  int;
  v_adj_id     uuid;
  v_user       uuid;
  v_punch_count int;
  v_punch_id   uuid;
begin
  -- Identificação determinística: ENTRADA aprovada do Rhuan em 01/09/2026.
  select count(*) into v_adj_count
  from public.punch_adjustments
  where ref_date = date '2026-09-01'
    and type = 'ENTRADA'
    and status = 'APROVADO'
    and employee_name ilike 'Rhuan%';

  if v_adj_count = 0 then
    raise notice '0081/Rhuan: ajuste não encontrado (já corrigido ou ausente); nada a fazer.';
    return;
  end if;
  if v_adj_count > 1 then
    raise exception '0081/Rhuan: identificação ambígua (% ajustes compatíveis) — abortando.', v_adj_count;
  end if;

  select id, user_id into v_adj_id, v_user
  from public.punch_adjustments
  where ref_date = date '2026-09-01'
    and type = 'ENTRADA'
    and status = 'APROVADO'
    and employee_name ilike 'Rhuan%';

  -- Batida original: exatamente uma ENTRADA do mesmo funcionário naquele dia
  -- (data local America/Sao_Paulo). punched_at permanece intacto.
  select count(*) into v_punch_count
  from public.time_punches tp
  where tp.type = 'ENTRADA'
    and (tp.user_id = v_user or (v_user is null and tp.employee_name ilike 'Rhuan%'))
    and (tp.punched_at at time zone 'America/Sao_Paulo')::date = date '2026-09-01';

  if v_punch_count <> 1 then
    raise exception '0081/Rhuan: esperava exatamente 1 ENTRADA original, encontrei % — abortando.', v_punch_count;
  end if;

  select tp.id into v_punch_id
  from public.time_punches tp
  where tp.type = 'ENTRADA'
    and (tp.user_id = v_user or (v_user is null and tp.employee_name ilike 'Rhuan%'))
    and (tp.punched_at at time zone 'America/Sao_Paulo')::date = date '2026-09-01';

  update public.punch_adjustments
  set requested_time = time '08:01',
      original_punch_id = v_punch_id
  where id = v_adj_id
    and status = 'APROVADO'
    and ( requested_time is distinct from time '08:01'
       or original_punch_id is distinct from v_punch_id );

  raise notice '0081/Rhuan: ajuste % vinculado à batida % com requested_time 08:01.', v_adj_id, v_punch_id;
end $$;

-- =========================================================================
-- B) BACKFILL GERAL — vincula original_punch_id quando é inequívoco
-- =========================================================================
-- Preenche APENAS original_punch_id (nunca requested_time) para ajustes
-- aprovados que já possuem horário solicitado mas perderam o vínculo.
-- Ajustes com requested_time NULL são deixados intactos (ver relatório).
do $$
declare
  r record;
  v_count int;
  v_punch_id uuid;
  v_linked int := 0;
begin
  for r in
    select id, user_id, employee_name, ref_date, type
    from public.punch_adjustments
    where status = 'APROVADO'
      and original_punch_id is null
      and requested_time is not null
  loop
    select count(*) into v_count
    from public.time_punches tp
    where tp.type = r.type
      and ( (r.user_id is not null and tp.user_id = r.user_id)
         or (r.user_id is null and tp.employee_name = r.employee_name) )
      and (tp.punched_at at time zone 'America/Sao_Paulo')::date = r.ref_date;

    if v_count = 1 then
      select tp.id into v_punch_id
      from public.time_punches tp
      where tp.type = r.type
        and ( (r.user_id is not null and tp.user_id = r.user_id)
           or (r.user_id is null and tp.employee_name = r.employee_name) )
        and (tp.punched_at at time zone 'America/Sao_Paulo')::date = r.ref_date;

      -- Respeita o índice único: uma batida só pode ter um aprovado vinculado.
      if not exists (
        select 1 from public.punch_adjustments
        where original_punch_id = v_punch_id and status = 'APROVADO'
      ) then
        update public.punch_adjustments set original_punch_id = v_punch_id where id = r.id;
        v_linked := v_linked + 1;
      end if;
    end if;
    -- 0 ou >1 correspondências: não vincula (conservador).
  end loop;

  raise notice '0081/backfill: % ajuste(s) vinculado(s) por correspondência única.', v_linked;
end $$;
