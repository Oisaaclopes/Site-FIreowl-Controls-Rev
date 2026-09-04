-- ETAPA 3B.3 — evidências inline no atendimento + condição da central SDAI.
--
-- Independente da 0086 (que pode ou não estar aplicada): nada aqui depende das
-- colunas/da view da 0086. Aditiva, idempotente, não-destrutiva. NÃO edita nem
-- reaplica 0083/0084/0085/0086.
--
-- 1) field_photos.evidence_moment: fase da evidência DENTRO do atendimento
--    (ANTES/DURANTE/DEPOIS) e a condição da central SDAI (CENTRAL_ANTES/
--    CENTRAL_DEPOIS). É distinto de `marcador` (antes/depois/falha/…), que
--    permanece intacto. Uma foto de CENTRAL_ANTES não precisa de cópia como
--    ANTES — a validação SDAI olha o momento específico (§30).
-- 2) service_attendances: condição da central na chegada/entrega + escape
--    "central não aplicável" com motivo (§18–§26).
-- 3) get_os_mission(): passa a devolver também `area` (proposal.areaPrincipal),
--    para o técnico saber, de forma ESTRUTURADA, se a OS é SDAI (§28). A RLS de
--    pedidos não libera o técnico; por isso a área vem por esta RPC SECURITY
--    DEFINER. Continua SEM QUALQUER dado comercial.
--
-- Requer: 0064 (field_photos), 0083 (service_attendances), 0033/0073
-- (ordens_servico), 0008 (pedidos), 0005 (auth_role).

-- 1) Momento da evidência ---------------------------------------------------
alter table public.field_photos
  add column if not exists evidence_moment text
    check (evidence_moment is null or evidence_moment in
      ('ANTES','DURANTE','DEPOIS','CENTRAL_ANTES','CENTRAL_DEPOIS'));

comment on column public.field_photos.evidence_moment is
  'Fase da evidência no atendimento (3B.3): ANTES/DURANTE/DEPOIS e a condição da '
  'central SDAI (CENTRAL_ANTES/CENTRAL_DEPOIS). Distinto de marcador. NULL = foto '
  'avulsa/Registro Rápido.';

create index if not exists field_photos_attendance_moment_idx
  on public.field_photos (service_attendance_id, evidence_moment)
  where service_attendance_id is not null;

-- 2) Condição da central no atendimento -------------------------------------
alter table public.service_attendances
  add column if not exists central_condition_initial text,
  add column if not exists central_condition_final   text,
  add column if not exists central_not_applicable    boolean not null default false,
  add column if not exists central_na_reason         text;

comment on column public.service_attendances.central_condition_initial is
  'SDAI (§19/§20): condição/falhas da central na CHEGADA. Texto curto; a foto vive '
  'em field_photos (evidence_moment=CENTRAL_ANTES).';
comment on column public.service_attendances.central_not_applicable is
  'SDAI (§26): quando não há central acessível neste serviço; exige central_na_reason. '
  'Dispensa a obrigatoriedade de condição inicial/final.';

-- 3) get_os_mission + area (create or replace; NÃO edita a 0085) -------------
create or replace function public.get_os_mission(p_os_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_os        public.ordens_servico%rowtype;
  v_prop      jsonb;
  v_services  jsonb;
  v_materials jsonb;
  v_resp      jsonb;
  v_ofertas   jsonb;
  v_area      jsonb;
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;

  select * into v_os from public.ordens_servico where id = p_os_id;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  if not (
    public.auth_role() in ('ADMINISTRATIVO','GESTOR','FINANCEIRO')
    or v_os.tecnico_responsavel_id = auth.uid()
  ) then
    raise exception 'sem acesso a esta OS';
  end if;

  if v_os.source_pedido_id is null then
    return jsonb_build_object(
      'found', true, 'source', 'os',
      'osNumero', v_os.numero, 'osTitulo', v_os.titulo, 'osDescricao', v_os.descricao,
      'services', '[]'::jsonb, 'materials', '[]'::jsonb,
      'responsibilities', '[]'::jsonb, 'servicosOfertados', '[]'::jsonb,
      'area', '[]'::jsonb
    );
  end if;

  select proposal into v_prop from public.pedidos where id = v_os.source_pedido_id;
  if v_prop is null then v_prop := '{}'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', e->>'descricao',
           'descricaoDetalhada', e->>'descricaoDetalhada',
           'marcaModelo', e->>'marcaModelo',
           'quantidade', (e->>'quantidade'),
           'unidade', e->>'unidade'
         )), '[]'::jsonb)
    into v_services
    from jsonb_array_elements(coalesce(v_prop->'equipmentItems','[]'::jsonb)) e
   where (e->>'tipo') = 'servico';

  select coalesce(jsonb_agg(jsonb_build_object(
           'descricao', e->>'descricao',
           'descricaoDetalhada', e->>'descricaoDetalhada',
           'marcaModelo', e->>'marcaModelo',
           'quantidade', (e->>'quantidade'),
           'unidade', e->>'unidade'
         )), '[]'::jsonb)
    into v_materials
    from jsonb_array_elements(coalesce(v_prop->'equipmentItems','[]'::jsonb)) e
   where coalesce(e->>'tipo','material') <> 'servico';

  v_resp := coalesce(v_prop->'responsabilidadesContratada', '[]'::jsonb);
  if jsonb_typeof(v_resp) <> 'array' then v_resp := '[]'::jsonb; end if;

  v_ofertas := coalesce(v_prop->'servicosOfertados', '[]'::jsonb);
  if jsonb_typeof(v_ofertas) <> 'array' then v_ofertas := '[]'::jsonb; end if;

  v_area := coalesce(v_prop->'areaPrincipal', '[]'::jsonb);
  if jsonb_typeof(v_area) <> 'array' then v_area := '[]'::jsonb; end if;

  return jsonb_build_object(
    'found', true, 'source', 'pedido',
    'osNumero', v_os.numero, 'osTitulo', v_os.titulo, 'osDescricao', v_os.descricao,
    'services', v_services,
    'materials', v_materials,
    'responsibilities', v_resp,
    'servicosOfertados', v_ofertas,
    'area', v_area
  );
end;
$$;

revoke all on function public.get_os_mission(uuid) from public;
grant execute on function public.get_os_mission(uuid) to authenticated;
